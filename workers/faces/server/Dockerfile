# The faces container (workers/faces): InsightFace buffalo_l (SCRFD + ArcFace, non-commercial licence) and YOLOX-s
# (Apache 2.0). Its parts are downloaded first by ../fetch-parts.sh, so building it needs no network.
FROM python:3.12-slim
COPY requirements.txt /app/
COPY parts/wheels /tmp/wheels
RUN pip install --no-cache-dir --no-index --find-links /tmp/wheels -r /app/requirements.txt && rm -rf /tmp/wheels
COPY parts/models /models
COPY look.py main.py /app/
WORKDIR /app
EXPOSE 8080
CMD ["python", "main.py", "8080"]
