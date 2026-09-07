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
# `ls` was the guard: if the export ever stops emitting bracketed filenames,
# the build fails rather than shipping a site whose dynamic routes silently
# serve the wrong document.
#
# It was half a guard, and the missing half is the one that mattered. Checking
# that a shell was *written* says nothing about whether nginx ever *asks* for
# it, and that is precisely where this went wrong: `entry` and `season` had
# shells here and no matching line in nginx.conf, so both were served
# /index.html — the feed's markup, byte for byte — for as long as they had
# existed. The comment above says a per-route line "has to be remembered, and
# it was not", and then the same thing happened again in the other file.
#
# So the guard now compares the two halves. Every shell this step writes must
# appear in the alternation in nginx.conf's dynamic-route location, or the
# build stops here. Adding a dynamic route without touching nginx is now a
# failed build instead of a page that quietly hydrates against the wrong
# document in production only.
RUN set -e; \
    for f in $(find dist -maxdepth 2 -name '*.html' | grep -F '['); do \
      cp "$f" "$(dirname "$f")/_shell.html"; \
    done; \
    ls -1 dist/*/_shell.html; \
    routes=$(grep -oE '\^/\([a-z|]+\)/' nginx.conf | tr -d '^/()'); \
    echo "nginx routes dynamic shells for: $routes"; \
    for d in dist/*/_shell.html; do \
      name=$(basename "$(dirname "$d")"); \
      echo "$routes" | tr '|' '\n' | grep -qx "$name" || { \
        echo "FAIL: /$name/<id> has a pre-rendered shell that nginx.conf does not route to."; \
        echo "      It would be served /index.html instead, and React would fail to hydrate it."; \
        echo "      Add '$name' to the alternation in nginx.conf's dynamic-route location."; \
        exit 1; \
      }; \
    done; \
    echo "every dynamic route's shell is routed by nginx"

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
