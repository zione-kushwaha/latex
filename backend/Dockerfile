FROM rust:1.85-bookworm AS builder

RUN apt-get update && apt-get install -y \
    pkg-config libssl-dev libfontconfig1-dev \
    libgraphite2-dev libharfbuzz-dev libicu-dev zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY Cargo.toml ./
RUN mkdir src && echo 'fn main(){}' > src/main.rs \
    && cargo build --release \
    && rm -rf src

COPY src ./src
RUN touch src/main.rs && cargo build --release

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates curl \
    libssl3 libfontconfig1 libgraphite2-3 \
    libharfbuzz0b libicu72 zlib1g \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.15.0/tectonic-0.15.0-x86_64-unknown-linux-gnu.tar.gz \
       | tar -xz -C /usr/local/bin \
    && chmod +x /usr/local/bin/tectonic

WORKDIR /app
COPY --from=builder /app/target/release/server ./server

# Pre-download tectonic TeX bundle so first compile doesn't timeout
RUN echo '\\documentclass{article}\\begin{document}hello\\end{document}' > /tmp/test.tex \
    && tectonic /tmp/test.tex --outdir /tmp \
    && rm -f /tmp/test.tex /tmp/test.pdf

ENV RUST_LOG=info
EXPOSE 3001
CMD ["./server"]
