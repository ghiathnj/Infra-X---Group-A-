FROM eclipse-temurin:17-jdk-jammy AS builder

WORKDIR /app

# Copy only pom.xml and Maven wrapper first (for better layer caching)
COPY pom.xml ./
COPY mvnw ./
COPY .mvn ./.mvn

# Make mvnw executable
RUN chmod +x mvnw

# Download dependencies (this layer will be cached if pom.xml hasn't changed)
RUN ./mvnw dependency:resolve dependency:resolve-plugins -q

# Copy source code
COPY src ./src

# Build application
RUN ./mvnw clean package -DskipTests -q

# Create runtime layer
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
COPY --from=builder /app/target/clinical-service-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
