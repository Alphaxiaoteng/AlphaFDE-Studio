FROM python:3.11-slim

WORKDIR /app

# Copy application files
COPY . /app

ENV HOST=0.0.0.0
ENV PORT=7860
EXPOSE 7860

CMD ["python3", "server.py"]
