FROM nginx:alpine

# Remove default nginx configurations
RUN rm -rf /etc/nginx/conf.d/*

# Copy custom reverse proxy config for port 3010
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy web application assets
COPY src/ /usr/share/nginx/html/

EXPOSE 3010

CMD ["nginx", "-g", "daemon off;"]
