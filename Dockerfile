FROM node:20-alpine
WORKDIR /app
COPY lab/package.json ./
RUN npm install --omit=dev
COPY lab/ ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
