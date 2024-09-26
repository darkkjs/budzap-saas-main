const Minio = require('minio');

const minioClient = new Minio.Client({
    endPoint: '147.79.111.143',
    port: 9000,
    useSSL: false,
    accessKey: 'minioadmin',
    secretKey: 'minioadmin'
});

module.exports = minioClient;