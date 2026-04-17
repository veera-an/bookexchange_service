FROM node:20
WORKDIR /app
COPY notification-service/package*.json ./
RUN npm install
COPY notification-service/ .
COPY shared/ ./shared/
CMD ["node", "index.js"]
