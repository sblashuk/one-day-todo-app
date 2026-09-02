FROM python:3.14-slim

WORKDIR /app

COPY pyproject.toml setup.cfg ./
COPY src ./src
RUN pip install --no-cache-dir -e .

COPY migrations ./migrations

EXPOSE 5000

CMD ["sh", "-c", "flask --app daylist db upgrade -d migrations && flask --app daylist run --host=0.0.0.0 --debug"]
