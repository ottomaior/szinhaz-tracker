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

# The Cloudflare Web Analytics site token for web.vastaps.app. Optional: when
# it is unset, app/+html.tsx renders no beacon tag and the build measures
# nothing, which is the right outcome for any build that is not production.
ARG EXPO_PUBLIC_CF_BEACON_TOKEN
ENV EXPO_PUBLIC_CF_BEACON_TOKEN=$EXPO_PUBLIC_CF_BEACON_TOKEN

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

# Every location block in nginx.conf must include the security headers.
#
# nginx does not inherit `add_header` into a block that sets one of its own,
# and every block in that file sets its own Cache-Control — so a block that
# forgets the include serves its route with no X-Frame-Options and nothing
# says so. That is the same shape of mistake as the missing dynamic-route
# lines above: invisible in review, invisible in the browser unless looked
# for, and wrong in production only. So the build counts them.
RUN set -e; \
    locations=$(grep -cE '^  location ' nginx.conf); \
    includes=$(grep -c 'include /etc/nginx/security-headers.conf;' nginx.conf); \
    echo "nginx.conf: $locations location blocks, $includes security-header includes"; \
    [ "$includes" -eq "$((locations + 1))" ] || { \
      echo "FAIL: a location block is missing the security-headers include."; \
      echo "      nginx does not inherit add_header into a block that sets one,"; \
      echo "      so that route would answer with no security headers at all."; \
      exit 1; \
    }; \
    echo "every location block includes the security headers"

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Not under conf.d/: nginx loads every *.conf there as a server config of its
# own, and this file is a fragment of directives meant to be included, not a
# server. It sits one level up and each location block asks for it by path.
COPY nginx-security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Parse the config at image-build time. Without this, a typo in nginx.conf or
# in the headers fragment is not discovered until the container starts and
# immediately exits — which is to say, during the deploy, on the production
# URL. `nginx -t` moves that to the build, where it is just a red check.
RUN nginx -t

EXPOSE 8080
