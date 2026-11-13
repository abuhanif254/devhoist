FROM node:22-alpine

WORKDIR /opt/devhost-agent
RUN apk add --no-cache docker-cli caddy-client postgresql16-client mariadb-client tar gzip

COPY package.json server.mjs ./

ENV AGENT_PORT=8787
ENV WORKSPACES_ROOT=/var/devhost/apps

EXPOSE 8787
CMD ["node", "server.mjs"]
