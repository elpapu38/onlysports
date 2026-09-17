FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate && npm run build && npm run css:build
RUN mkdir -p /data && DATABASE_URL="file:/data/onlysports.db" npx prisma migrate deploy
EXPOSE 3000
CMD ["npm", "start"]
