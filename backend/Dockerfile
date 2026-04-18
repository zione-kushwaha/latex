FROM rust:1.82-bookworm

RUN apt-get update && apt-get install -y \
    pkg-config libssl-dev libfontconfig1-dev \
    libgraphite2-dev libharfbuzz-dev libicu-dev \
    zlib1g-dev ca-certificates curl tectonic \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Cargo.toml Cargo.lock* ./
RUN mkdir src && echo 'fn main(){}' > src/main.rs \
    && cargo build --release \
    && rm -rf src

COPY src ./src
RUN touch src/main.rs && cargo build --release

ENV RUST_LOG=info

CMD ["./target/release/server"]
