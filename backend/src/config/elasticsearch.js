const { Client } = require('@elastic/elasticsearch');

const elasticClient = new Client({
  node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
});

const connectElasticsearch = async () => {
  try {
    const info = await elasticClient.info();
    console.log(`✅ Elasticsearch connected: ${info.version.number}`);
    return elasticClient;
  } catch (error) {
    console.error('❌ Elasticsearch connection failed:', error.message);
    return null;
  }
};

module.exports = {
  elasticClient,
  connectElasticsearch,
};