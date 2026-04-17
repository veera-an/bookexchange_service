FROM node:20
WORKDIR /app
COPY book-service/package*.json ./
RUN npm install
COPY book-service/ .
COPY shared/ ./shared/
EXPOSE 5002
CMD ["npm", "start"]
