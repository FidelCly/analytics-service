FROM node:latest
WORKDIR /analytics-service
COPY package.json ./
RUN npm install
COPY . ./
CMD npm run start:dev
EXPOSE 5000