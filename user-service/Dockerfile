FROM node:20
WORKDIR /app
COPY user-service/package*.json ./
RUN npm install
COPY user-service/ .
COPY shared/ ./shared/
EXPOSE 5001
CMD ["npm", "start"]
