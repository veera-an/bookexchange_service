FROM node:20
WORKDIR /app
COPY exchange-service/package*.json ./
RUN npm install
COPY exchange-service/ .
COPY shared/ ./shared/
EXPOSE 5003
CMD ["npm", "start"]
