FROM node:22-bookworm

WORKDIR /app

RUN apt-get update \
    && apt-get install -y python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install

COPY . .

RUN python3 -m venv /opt/venv

RUN /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install \
       pandas \
       scikit-learn \
       psycopg2-binary \
       python-dotenv

ENV PATH="/opt/venv/bin:$PATH"

CMD ["npm", "start"]