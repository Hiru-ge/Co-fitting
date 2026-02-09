FROM node:22-alpine
WORKDIR /app

# パッケージ情報をコピーしてインストール
COPY package*.json ./
RUN npm install

# ソースコードをコピー
COPY . .

# Viteの開発サーバーを起動 (外部からアクセスできるよう --host を指定)
CMD ["npm", "run", "dev", "--", "--host"]