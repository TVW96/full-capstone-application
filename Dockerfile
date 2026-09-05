# syntax=docker/dockerfile:1
######### Node Configuration ##############
FROM alpine:latest as base

########## Build Stage ##############
FROM base as build
RUN echo -e '#!/bin/sh\n\
echo Hello world from $(whoami)! In order to get your application running in a container, take a look at the comments in the Dockerfile to get started.'\
> /bin/hello.sh
RUN chmod +x /bin/hello.sh

######### Final Stage ##############
FROM base AS final
ARG UID=10001
RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/nonexistent" \
    --shell "/sbin/nologin" \
    --no-create-home \
    --uid "${UID}" \
    appuser
USER appuser

######### Copy the executable from the "build" stage.
# Copy the executable from the "build" stage.
COPY --from=build /bin/hello.sh /bin/
# What the container should run when it is started.
ENTRYPOINT [ "/bin/hello.sh" ]
