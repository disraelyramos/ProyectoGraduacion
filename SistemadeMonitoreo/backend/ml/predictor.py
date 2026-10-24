
import os
import json
import math
import sys

from bisect import bisect_right
from pathlib import Path

import numpy as np
import pandas as pd
import psycopg2

from dotenv import load_dotenv
from sklearn.linear_model import HuberRegressor


# =========================================================
# CONFIGURACIÓN
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME")

ML_MIN_LECTURAS = int(
    os.getenv("ML_MIN_LECTURAS", "8")
)

ML_MIN_CRECIMIENTO_DIA = float(
    os.getenv("ML_MIN_CRECIMIENTO_DIA", "0.1")
)

ML_MAX_DIAS_PREDICCION = int(
    os.getenv("ML_MAX_DIAS_PREDICCION", "3650")
)

ML_MIN_HORAS_CICLO = float(
    os.getenv("ML_MIN_HORAS_CICLO", "12")
)

ML_MIN_AUMENTO_CICLO = float(
    os.getenv("ML_MIN_AUMENTO_CICLO", "1")
)

ML_CAIDA_ANOMALA_PCT = float(
    os.getenv("ML_CAIDA_ANOMALA_PCT", "20")
)

ML_AGRUPACION_HORAS = int(
    os.getenv("ML_AGRUPACION_HORAS", "1")
)

ML_MAX_CICLOS_HISTORICOS = int(
    os.getenv("ML_MAX_CICLOS_HISTORICOS", "10")
)


if (
    ML_MIN_LECTURAS < 2
    or not math.isfinite(ML_MIN_CRECIMIENTO_DIA)
    or not 0 < ML_MIN_CRECIMIENTO_DIA <= 100
    or ML_MAX_DIAS_PREDICCION <= 0
    or not math.isfinite(ML_MIN_HORAS_CICLO)
    or ML_MIN_HORAS_CICLO <= 0
    or not math.isfinite(ML_MIN_AUMENTO_CICLO)
    or ML_MIN_AUMENTO_CICLO <= 0
    or not math.isfinite(ML_CAIDA_ANOMALA_PCT)
    or ML_CAIDA_ANOMALA_PCT <= 0
    or ML_AGRUPACION_HORAS < 1
    or ML_MAX_CICLOS_HISTORICOS < 1
):
    raise RuntimeError(
        "Configuración de Machine Learning inválida."
    )


# =========================================================
# CONEXIÓN POSTGRESQL
# =========================================================

def obtener_conexion():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        connect_timeout=10
    )


# =========================================================
# CONFIGURACIÓN DE ALERTAS
# =========================================================

def obtener_configuracion_alertas(conn):
    sql = """
        SELECT
            primer_aviso_pct,
            segundo_aviso_pct,
            activa
        FROM configuracion_alertas
        WHERE id = 1
    """

    with conn.cursor() as cursor:
        cursor.execute(sql)
        fila = cursor.fetchone()

    if not fila:
        raise RuntimeError(
            "No existe configuración de alertas."
        )

    aviso = float(fila[0])
    alto = float(fila[1])

    if (
        not 0 < aviso < alto <= 100
    ):
        raise RuntimeError(
            "Umbrales de alertas inválidos."
        )

    return {
        "umbral_aviso": aviso,
        "umbral_alto": alto,
        "alertas_activas": bool(fila[2])
    }


# =========================================================
# CONSULTAR LECTURAS HISTÓRICAS
# =========================================================
#
# No se utilizan IDs fijos de los catálogos.
#
# Se aceptan únicamente:
# - Lecturas de nivel.
# - Unidad porcentaje.
# - Estado normal.
# - Valores válidos entre 0 y 100.
#
# Las lecturas simuladas y reales deben
# distinguirse en fuente_lectura.
#
# =========================================================

def obtener_lecturas(conn, contenedor_id):
    sql = """
        SELECT
            l.id,
            l.valor,
            l.fecha_hora,
            l.fuente_lectura

        FROM lecturas l

        JOIN tipos_lectura t
          ON t.id = l.tipo_lectura_id

        JOIN unidad_medida u
          ON u.id = l.unidad_id

        WHERE l.contenedor_id = %s

          AND LOWER(t.nombre) LIKE '%%nivel%%'

          AND (
            LOWER(u.nombre) LIKE '%%porcentaje%%'
            OR TRIM(u.nombre) = '%%'
          )

          AND LOWER(l.estado_lectura) = 'normal'

          AND l.valor BETWEEN 0 AND 100

        ORDER BY
            l.fecha_hora ASC,
            l.id ASC
    """

    with conn.cursor() as cursor:
        cursor.execute(sql, (contenedor_id,))
        filas = cursor.fetchall()

    df = pd.DataFrame(
        filas,
        columns=[
            "id",
            "valor",
            "fecha_hora",
            "fuente_lectura"
        ]
    )

    if df.empty:
        return df

    df["fecha_hora"] = pd.to_datetime(
        df["fecha_hora"],
        errors="coerce"
    )

    df["valor"] = pd.to_numeric(
        df["valor"],
        errors="coerce"
    )

    df = df.dropna(
        subset=["fecha_hora", "valor"]
    )

    return df.sort_values(
        ["fecha_hora", "id"]
    ).reset_index(drop=True)


# =========================================================
# CONSULTAR RECOLECCIONES REALES
# =========================================================
#
# Se utilizan únicamente las fechas registradas
# por el proceso de recolección del sistema.
#
# No se crean recolecciones artificiales.
#
# =========================================================

def obtener_recolecciones(conn, contenedor_id):
    sql = """
        SELECT fecha_recoleccion
        FROM recolecciones
        WHERE contenedor_id = %s
          AND fecha_recoleccion IS NOT NULL
        ORDER BY fecha_recoleccion ASC
    """

    with conn.cursor() as cursor:
        cursor.execute(sql, (contenedor_id,))
        filas = cursor.fetchall()

    fechas = pd.to_datetime(
        [fila[0] for fila in filas],
        errors="coerce"
    )

    return sorted(
        fecha
        for fecha in fechas
        if not pd.isna(fecha)
    )


# =========================================================
# SEPARAR CICLOS POR RECOLECCIONES
# =========================================================
#
# Ciclo 0: antes de primera recolección.
# Ciclo 1: después de primera recolección.
# Ciclo 2: después de segunda recolección.
#
# No se supone que toda caída de nivel sea
# una recolección.
#
# =========================================================

def separar_ciclos(df, fechas_recoleccion):
    if df.empty:
        return df.copy()

    datos = df.copy()

    datos["ciclo"] = datos[
        "fecha_hora"
    ].apply(
        lambda fecha: bisect_right(
            fechas_recoleccion,
            fecha
        )
    )

    return datos


# =========================================================
# AGRUPAR LECTURAS POR HORAS
# =========================================================
#
# Evita entrenar cientos de veces con
# el mismo valor dentro de una misma hora.
#
# Se usa la mediana de cada intervalo.
#
# =========================================================

def agrupar_lecturas(df):
    if df.empty:
        return df

    datos = df.copy()

    datos["intervalo"] = datos[
        "fecha_hora"
    ].dt.floor(
        f"{ML_AGRUPACION_HORAS}h"
    )

    resultado = (
        datos.groupby(
            "intervalo",
            as_index=False
        )
        .agg(
            valor=("valor", "median"),
            total_lecturas=("valor", "size")
        )
        .rename(
            columns={
                "intervalo": "fecha_hora"
            }
        )
    )

    return resultado.sort_values(
        "fecha_hora"
    ).reset_index(drop=True)


# =========================================================
# COMPROBAR CONSISTENCIA DE UN CICLO
# =========================================================
#
# Una caída brusca dentro de un ciclo de
# recolección se considera inconsistencia.
#
# No se fabrica otro ciclo automáticamente.
#
# =========================================================

def ciclo_tiene_caida_anomala(df):
    if len(df) < 2:
        return False

    valores = df["valor"].to_numpy(
        dtype=float
    )

    caidas = valores[:-1] - valores[1:]

    return bool(
        np.any(
            caidas >= ML_CAIDA_ANOMALA_PCT
        )
    )


# =========================================================
# ENTRENAR HUBER REGRESSOR
# =========================================================

def entrenar_ciclo(ciclo_df):
    if ciclo_df.empty:
        return None

    if len(ciclo_df) < ML_MIN_LECTURAS:
        return None

    ciclo_df = agrupar_lecturas(
        ciclo_df
    )

    # Se requieren suficientes intervalos
    # independientes, no solo lecturas repetidas.

    if len(ciclo_df) < 2:
        return None

    if ciclo_tiene_caida_anomala(ciclo_df):
        return None

    fecha_inicio = ciclo_df[
        "fecha_hora"
    ].min()

    fecha_fin = ciclo_df[
        "fecha_hora"
    ].max()

    horas = (
        fecha_fin - fecha_inicio
    ).total_seconds() / 3600

    if horas < ML_MIN_HORAS_CICLO:
        return None

    primer_nivel = float(
        ciclo_df.iloc[0]["valor"]
    )

    ultimo_nivel = float(
        ciclo_df.iloc[-1]["valor"]
    )

    aumento = (
        ultimo_nivel - primer_nivel
    )

    if aumento < ML_MIN_AUMENTO_CICLO:
        return None

    dias = (
        ciclo_df["fecha_hora"]
        - fecha_inicio
    ).dt.total_seconds() / 86400

    X = dias.to_numpy(
        dtype=float
    ).reshape(-1, 1)

    y = ciclo_df["valor"].to_numpy(
        dtype=float
    )

    if not np.all(np.isfinite(X)):
        return None

    if not np.all(np.isfinite(y)):
        return None

    if len(np.unique(X)) < 2:
        return None

    try:
        modelo = HuberRegressor(
            max_iter=500
        )

        modelo.fit(X, y)

        pendiente = float(
            modelo.coef_[0]
        )

    except (ValueError, RuntimeError):
        return None

    if (
        not math.isfinite(pendiente)
        or pendiente <= 0
    ):
        return None

    return {
        "pendiente": pendiente,
        "lecturas": len(ciclo_df),
        "aumento": aumento,
        "horas": horas
    }


# =========================================================
# CALCULAR TENDENCIA HISTÓRICA
# =========================================================
#
# Utiliza únicamente ciclos con crecimiento
# positivo y datos suficientes.
#
# Se limita la cantidad de ciclos históricos.
#
# La mediana de pendientes reduce el efecto
# de ciclos con crecimientos extremos.
#
# =========================================================

def calcular_tendencia_historica(
    df,
    fechas_recoleccion
):
    datos = separar_ciclos(
        df,
        fechas_recoleccion
    )

    resultados = []

    for _, ciclo_df in datos.groupby(
        "ciclo",
        sort=True
    ):
        resultado = entrenar_ciclo(
            ciclo_df
        )

        if resultado:
            resultados.append(
                resultado
            )

    if not resultados:
        return None

    resultados = resultados[
        -ML_MAX_CICLOS_HISTORICOS:
    ]

    pendientes = [
        r["pendiente"]
        for r in resultados
    ]

    crecimiento = float(
        np.median(pendientes)
    )

    return {
        "crecimiento_promedio_dia": crecimiento,
        "ciclos_utilizados": len(resultados)
    }


# =========================================================
# OBTENER NIVEL ACTUAL
# =========================================================
#
# Se conserva la misma fuente utilizada
# por el predictor anterior: contenedores.
#
# =========================================================

def obtener_nivel_actual(conn, contenedor_id):
    sql = """
        SELECT
            estado_actual_litros,
            capacidad_max_litros

        FROM contenedores

        WHERE id_contenedor = %s
    """

    with conn.cursor() as cursor:
        cursor.execute(sql, (contenedor_id,))
        fila = cursor.fetchone()

    if not fila:
        return None

    litros = float(fila[0] or 0)
    capacidad = float(fila[1] or 0)

    if (
        not math.isfinite(litros)
        or not math.isfinite(capacidad)
        or capacidad <= 0
        or litros < 0
        or litros > capacidad
    ):
        return None

    return round(
        litros / capacidad * 100,
        2
    )


# =========================================================
# CALCULAR DÍAS PARA UMBRAL
# =========================================================

def calcular_dias_para_umbral(
    nivel_actual,
    crecimiento_dia,
    umbral
):
    if nivel_actual >= umbral:
        return 0.0

    if (
        not math.isfinite(crecimiento_dia)
        or crecimiento_dia < ML_MIN_CRECIMIENTO_DIA
    ):
        return None

    dias = (
        umbral - nivel_actual
    ) / crecimiento_dia

    if (
        not math.isfinite(dias)
        or dias > ML_MAX_DIAS_PREDICCION
    ):
        return None

    return round(
        max(dias, 0),
        2
    )


# =========================================================
# CLASIFICAR RIESGO
# =========================================================

def clasificar_riesgo(dias_para_alto):
    if dias_para_alto is None:
        return "SIN_DATOS"

    if dias_para_alto <= 1:
        return "ALTO"

    if dias_para_alto <= 3:
        return "MEDIO"

    return "BAJO"


# =========================================================
# PREDECIR CONTENEDOR
# =========================================================

def predecir_contenedor(
    conn,
    contenedor_id,
    configuracion
):
    lecturas = obtener_lecturas(
        conn,
        contenedor_id
    )

    if lecturas.empty:
        return {
            "contenedor_id": contenedor_id,
            "estado": "SIN_DATOS"
        }

    fechas_recoleccion = obtener_recolecciones(
        conn,
        contenedor_id
    )

    tendencia = calcular_tendencia_historica(
        lecturas,
        fechas_recoleccion
    )

    if not tendencia:
        return {
            "contenedor_id": contenedor_id,
            "estado": "DATOS_INSUFICIENTES"
        }

    nivel_actual = obtener_nivel_actual(
        conn,
        contenedor_id
    )

    if nivel_actual is None:
        return {
            "contenedor_id": contenedor_id,
            "estado": "SIN_NIVEL_ACTUAL"
        }

    crecimiento = tendencia[
        "crecimiento_promedio_dia"
    ]

    if (
        not math.isfinite(crecimiento)
        or crecimiento < ML_MIN_CRECIMIENTO_DIA
    ):
        return {
            "contenedor_id": contenedor_id,
            "estado": "CRECIMIENTO_INSUFICIENTE"
        }

    umbral_aviso = configuracion[
        "umbral_aviso"
    ]

    umbral_alto = configuracion[
        "umbral_alto"
    ]

    dias_aviso = calcular_dias_para_umbral(
        nivel_actual,
        crecimiento,
        umbral_aviso
    )

    dias_alto = calcular_dias_para_umbral(
        nivel_actual,
        crecimiento,
        umbral_alto
    )

    if dias_alto is None:
        return {
            "contenedor_id": contenedor_id,
            "estado": "PREDICCION_NO_CONFIABLE"
        }

    return {
        "contenedor_id": contenedor_id,
        "estado": "OK",

        "nivel_actual": nivel_actual,

        "crecimiento_estimado_dia": round(
            crecimiento,
            2
        ),

        "dias_para_aviso": dias_aviso,
        "dias_para_alto": dias_alto,

        "umbral_aviso": umbral_aviso,
        "umbral_alto": umbral_alto,

        "alertas_activas": configuracion[
            "alertas_activas"
        ],

        "riesgo": clasificar_riesgo(
            dias_alto
        ),

        "ciclos_utilizados": tendencia[
            "ciclos_utilizados"
        ]
    }


# =========================================================
# OBTENER CONTENEDORES ACTIVOS
# =========================================================

def obtener_contenedores(conn):
    sql = """
        SELECT id_contenedor
        FROM contenedores
        WHERE estado_id = 1
        ORDER BY id_contenedor
    """

    with conn.cursor() as cursor:
        cursor.execute(sql)
        filas = cursor.fetchall()

    return [
        fila[0]
        for fila in filas
    ]


# =========================================================
# MAIN
# =========================================================

def main():
    resultados = []

    with obtener_conexion() as conn:
        configuracion = obtener_configuracion_alertas(
            conn
        )

        contenedores = obtener_contenedores(
            conn
        )

        for contenedor_id in contenedores:
            resultado = predecir_contenedor(
                conn,
                contenedor_id,
                configuracion
            )

            resultados.append(
                resultado
            )

    # stdout exclusivamente JSON.
    # El servicio Node.js depende de este formato.

    print(
        json.dumps(
            resultados,
            indent=2,
            ensure_ascii=False
        )
    )


if __name__ == "__main__":
    try:
        main()

    except Exception as error:
        print(
            f"Error Machine Learning: {error}",
            file=sys.stderr
        )

        sys.exit(1)
