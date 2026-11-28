# Image web Next.js cho bản chạy chung (compose.yaml) — Hoàng Anh.
# Chạy "next dev" vì phiên demo của Chúc chỉ bật khi NODE_ENV=development.
# Không chứa bí mật: mật khẩu demo được truyền lúc chạy từ .env của từng máy.
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN mkdir /app && chown node:node /app
USER node
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci
COPY --chown=node:node . .
RUN mkdir -p /app/data/private/photos && chmod 700 /app/data/private/photos
# prisma generate chỉ cần cấu hình đọc được URL, không kết nối DB.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run db:generate
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
# Webpack avoids the Turbopack development reload loop observed inside Docker.
# The browser host remains loopback; demo sessions keep their existing checks.
CMD ["node_modules/.bin/next", "dev", "--webpack", "--port", "3000"]
