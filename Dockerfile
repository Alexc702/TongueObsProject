FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.js ./
COPY server ./server

ENV NODE_ENV=production
EXPOSE 3100

CMD ["npm", "start"]
