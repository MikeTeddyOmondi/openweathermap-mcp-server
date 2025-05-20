# Help
default:
    just --list 

# Build the image
image-sse:
    docker build -t openweathermap-mcp-server .

# Run the SSE container
run-con-sse:
    docker run -d -p 10203:10203 --env-file .env --name openweather-mcp-server openweathermap-mcp-server

# Remove SSE container
rm-con-sse:
    docker stop openweather-mcp-server
    docker rm openweather-mcp-server

# Remove SSE container
con-sse-logs:
    docker logs -f openweather-mcp-server   
