import os
import json
from pathlib import Path

import pandas as pd
import psycopg2

from dotenv import load_dotenv
from sklearn.linear_model import HuberRegressor


# =========================================================
# CARGAR .ENV DE LA RAÍZ DEL BACKEND
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

load_dotenv(ENV_PATH)


# =========================================================
# CONFIGURACIÓN DE BASE DE DATOS
# =========================================================

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME")


# =========================================================
# CONFIGURACIÓN MACHINE LEARNING
# =========================================================

ML_MIN_LECTURAS = int(
    os.getenv("ML_MIN_LECTURAS", "8")
)


# =========================================================
# VALIDAR VARIABLES
# =========================================================

variables_faltantes = []

if not DB_USER:
    variables_faltantes.append("DB_USER")

if not DB_PASSWORD:
    variables_faltantes.append("DB_PASSWORD")

if not DB_HOST:
    variables_faltantes.append("DB_HOST")

if not DB_NAME:
    variables_faltantes.append("DB_NAME")


if variables_faltantes:
    raise RuntimeError(
        "Faltan variables en el .env: "
        + ", ".join(variables_faltantes)
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
        password=DB_PASSWORD
    )


# =========================================================
# OBTENER CONFIGURACIÓN DE ALERTAS
# =========================================================

def obtener_configuracion_alertas():

    sql = """
        SELECT
            primer_aviso_pct,
            segundo_aviso_pct,
            activa
        FROM configuracion_alertas
        WHERE id = 1;
    """

    with obtener_conexion() as conn:
        with conn.cursor() as cursor:

            cursor.execute(sql)

            fila = cursor.fetchone()

    if not fila:
        raise RuntimeError(
            "No existe configuración de alertas."
        )

    umbral_aviso = float(fila[0])
    umbral_alto = float(fila[1])
    activa = bool(fila[2])

    if umbral_aviso <= 0 or umbral_aviso > 100:
        raise RuntimeError(
            "El primer umbral configurado no es válido."
        )

    if umbral_alto <= 0 or umbral_alto > 100:
        raise RuntimeError(
            "El segundo umbral configurado no es válido."
        )

    if umbral_aviso >= umbral_alto:
        raise RuntimeError(
            "El primer umbral debe ser menor que el segundo."
        )

    return {
        "umbral_aviso": umbral_aviso,
        "umbral_alto": umbral_alto,
        "alertas_activas": activa
    }


# =========================================================
# OBTENER LECTURAS DE NIVEL
# =========================================================

def obtener_lecturas(contenedor_id):

    sql = """
        SELECT
            id,
            contenedor_id,
            valor,
            fecha_hora
        FROM lecturas
        WHERE contenedor_id = %s
          AND tipo_lectura_id = 1
          AND unidad_id = 1
          AND estado_lectura = 'normal'
        ORDER BY fecha_hora ASC;
    """

    with obtener_conexion() as conn:
        with conn.cursor() as cursor:

            cursor.execute(
                sql,
                (contenedor_id,)
            )

            filas = cursor.fetchall()

            columnas = [
                descripcion[0]
                for descripcion in cursor.description
            ]

    df = pd.DataFrame(
        filas,
        columns=columnas
    )

    if not df.empty:
        df["fecha_hora"] = pd.to_datetime(
            df["fecha_hora"]
        )

    return df


# =========================================================
# SEPARAR CICLOS DE LLENADO
# =========================================================

def separar_ciclos(df):
    """
    Una caída de 20 puntos porcentuales o más
    se interpreta como inicio de un nuevo ciclo.
    """

    df = df.copy()

    df["ciclo"] = 0

    ciclo_actual = 0
    nivel_anterior = None

    for indice, fila in df.iterrows():

        nivel_actual = float(
            fila["valor"]
        )

        if nivel_anterior is not None:

            diferencia = (
                nivel_anterior
                - nivel_actual
            )

            if diferencia >= 20:
                ciclo_actual += 1

        df.at[
            indice,
            "ciclo"
        ] = ciclo_actual

        nivel_anterior = nivel_actual

    return df


# =========================================================
# PREPARAR CICLO
# =========================================================

def preparar_ciclo(ciclo_df):

    ciclo_df = (
        ciclo_df
        .copy()
        .sort_values("fecha_hora")
    )

    fecha_inicio = (
        ciclo_df["fecha_hora"]
        .min()
    )

    ciclo_df["dias"] = (
        ciclo_df["fecha_hora"]
        - fecha_inicio
    ).dt.total_seconds() / 86400

    return ciclo_df


# =========================================================
# ENTRENAR HUBER REGRESSOR
# =========================================================

def entrenar_ciclo(ciclo_df):

    if len(ciclo_df) < ML_MIN_LECTURAS:
        return None

    ciclo_df = preparar_ciclo(
        ciclo_df
    )

    X = ciclo_df[["dias"]]
    y = ciclo_df["valor"]

    modelo = HuberRegressor()

    modelo.fit(
        X,
        y
    )

    pendiente = float(
        modelo.coef_[0]
    )

    intercepto = float(
        modelo.intercept_
    )

    return {
        "pendiente": pendiente,
        "intercepto": intercepto,
        "lecturas": len(ciclo_df)
    }


# =========================================================
# CALCULAR TENDENCIA HISTÓRICA
# =========================================================

def calcular_tendencia_historica(df):

    df = separar_ciclos(
        df
    )

    resultados = []

    for _, ciclo_df in df.groupby(
        "ciclo"
    ):

        resultado = entrenar_ciclo(
            ciclo_df
        )

        if (
            resultado
            and resultado["pendiente"] > 0
        ):
            resultados.append(
                resultado
            )

    if not resultados:
        return None

    pendientes = [
        resultado["pendiente"]
        for resultado in resultados
    ]

    crecimiento_promedio = (
        sum(pendientes)
        / len(pendientes)
    )

    return {
        "crecimiento_promedio_dia":
            crecimiento_promedio,

        "ciclos_utilizados":
            len(resultados)
    }


# =========================================================
# OBTENER NIVEL ACTUAL
# =========================================================

def obtener_nivel_actual(
    contenedor_id
):

    sql = """
        SELECT
            estado_actual_litros,
            capacidad_max_litros
        FROM contenedores
        WHERE id_contenedor = %s;
    """

    with obtener_conexion() as conn:
        with conn.cursor() as cursor:

            cursor.execute(
                sql,
                (contenedor_id,)
            )

            fila = cursor.fetchone()

    if not fila:
        return None

    litros_actuales = float(
        fila[0] or 0
    )

    capacidad_maxima = float(
        fila[1] or 0
    )

    if capacidad_maxima <= 0:
        return None

    porcentaje = (
        litros_actuales
        / capacidad_maxima
    ) * 100

    return round(
        porcentaje,
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

    if crecimiento_dia <= 0:
        return None

    dias = (
        umbral
        - nivel_actual
    ) / crecimiento_dia

    return round(
        max(dias, 0),
        2
    )


# =========================================================
# CLASIFICAR RIESGO
# =========================================================

def clasificar_riesgo(
    dias_para_alto
):

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
    contenedor_id,
    configuracion_alertas
):

    lecturas = obtener_lecturas(
        contenedor_id
    )

    if lecturas.empty:

        return {
            "contenedor_id":
                contenedor_id,

            "estado":
                "SIN_DATOS"
        }

    tendencia = (
        calcular_tendencia_historica(
            lecturas
        )
    )

    if not tendencia:

        return {
            "contenedor_id":
                contenedor_id,

            "estado":
                "DATOS_INSUFICIENTES"
        }

    nivel_actual = obtener_nivel_actual(
        contenedor_id
    )

    if nivel_actual is None:

        return {
            "contenedor_id":
                contenedor_id,

            "estado":
                "SIN_NIVEL_ACTUAL"
        }

    crecimiento = tendencia[
        "crecimiento_promedio_dia"
    ]

    umbral_aviso = configuracion_alertas[
        "umbral_aviso"
    ]

    umbral_alto = configuracion_alertas[
        "umbral_alto"
    ]

    dias_aviso = (
        calcular_dias_para_umbral(
            nivel_actual,
            crecimiento,
            umbral_aviso
        )
    )

    dias_alto = (
        calcular_dias_para_umbral(
            nivel_actual,
            crecimiento,
            umbral_alto
        )
    )

    return {

        "contenedor_id":
            contenedor_id,

        "estado":
            "OK",

        "nivel_actual":
            nivel_actual,

        "crecimiento_estimado_dia":
            round(
                crecimiento,
                2
            ),

        "dias_para_aviso":
            dias_aviso,

        "dias_para_alto":
            dias_alto,

        "umbral_aviso":
            umbral_aviso,

        "umbral_alto":
            umbral_alto,

        "alertas_activas":
            configuracion_alertas[
                "alertas_activas"
            ],

        "riesgo":
            clasificar_riesgo(
                dias_alto
            ),

        "ciclos_utilizados":
            tendencia[
                "ciclos_utilizados"
            ]
    }


# =========================================================
# OBTENER CONTENEDORES ACTIVOS
# =========================================================

def obtener_contenedores():

    sql = """
        SELECT
            id_contenedor
        FROM contenedores
        WHERE estado_id = 1
        ORDER BY id_contenedor;
    """

    with obtener_conexion() as conn:
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

    configuracion_alertas = (
        obtener_configuracion_alertas()
    )

    contenedores = (
        obtener_contenedores()
    )

    for contenedor_id in contenedores:

        resultado = (
            predecir_contenedor(
                contenedor_id,
                configuracion_alertas
            )
        )

        resultados.append(
            resultado
        )

    print(
        json.dumps(
            resultados,
            indent=2,
            ensure_ascii=False
        )
    )


if __name__ == "__main__":
    main()