###############################################
# Frontend Image
###############################################
FROM node:24-alpine3.21 AS production-frontend

WORKDIR /app

COPY ["./package.json", "./package-lock.json*", "./"]
RUN npm install --ignore-scripts

COPY . .

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["npm","run","serve"]
