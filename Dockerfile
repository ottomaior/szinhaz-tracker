# Node 22+ required: @supabase/supabase-js needs native WebSocket support,
# which Node 20 doesn't have — `expo export` executes app code (including
# the Supabase client) during static rendering, so the build itself would
# crash on Node 20, the same way the sync job did on the GitHub Actions runner.
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./

ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY
ENV EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL
ENV EXPO_PUBLIC_SUPABASE_ANON_KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

# expo export names a dynamic route's pre-rendered shell after the route file —
# literally "[id].html". nginx can serve a path with brackets in it, but that is
# an avoidable thing to get subtly wrong in a config file, so give each shell a
# plain name here and let nginx reference that instead.
#
# Every dynamic route, found rather than listed. This used to name play/ and
# user/ explicitly, and adding /person/ and /list/ to nginx without adding them
# here reintroduced exactly the bug the nginx comment describes: try_files fell
# through to /index.html and both routes were served the feed's markup, byte for
# byte, in production only. A per-route line here is a step that has to be
# remembered, and it was not.
#
# `ls` at the end is the guard: if the export ever stops emitting bracketed
# filenames, this fails the build rather than shipping a site whose dynamic
# routes silently serve the wrong document.
RUN for f in $(find dist -maxdepth 2 -name '*.html' | grep -F '['); do \
      cp "$f" "$(dirname "$f")/_shell.html"; \
    done \
 && ls -1 dist/*/_shell.html

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
