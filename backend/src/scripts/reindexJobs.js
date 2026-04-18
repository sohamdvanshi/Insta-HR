require('dotenv').config();

const sequelize = require('../config/database');
const Job = require('../models/Job');
const { elasticClient } = require('../config/elasticsearch');
const {
  ensureJobsIndex,
  JOBS_INDEX
} = require('../services/search/jobSearch.service');

const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

const toJobDocument = (jobInstance) => {
  const doc = jobInstance.toJSON ? jobInstance.toJSON() : jobInstance;

  return {
    id: doc.id,
    employerId: doc.employerId,
    title: doc.title,
    description: doc.description,
    companyName: doc.companyName,
    location: doc.location,
    jobType: doc.jobType,
    industry: doc.industry,
    experienceLevel: doc.experienceLevel,
    status: doc.status,
    currency: doc.currency,
    minExperienceYears: doc.minExperienceYears,
    salaryMin: doc.salaryMin,
    salaryMax: doc.salaryMax,
    minimumEducation: doc.minimumEducation,
    requiredSkills: Array.isArray(doc.requiredSkills) ? doc.requiredSkills : [],
    preferredSkills: Array.isArray(doc.preferredSkills) ? doc.preferredSkills : [],
    responsibilities: Array.isArray(doc.responsibilities) ? doc.responsibilities : [],
    qualifications: Array.isArray(doc.qualifications) ? doc.qualifications : [],
    benefits: Array.isArray(doc.benefits) ? doc.benefits : [],
    isFeatured: !!doc.isFeatured,
    featuredUntil: doc.featuredUntil || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    applicationDeadline: doc.applicationDeadline || null
  };
};

const rebuildJobsIndex = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    const exists = await elasticClient.indices.exists({ index: JOBS_INDEX });

    if (exists) {
      await elasticClient.indices.delete({ index: JOBS_INDEX });
      console.log(`🗑️ Deleted old Elasticsearch index: ${JOBS_INDEX}`);
    } else {
      console.log(`ℹ️ Index does not exist yet: ${JOBS_INDEX}`);
    }

    await ensureJobsIndex();

    const jobs = await Job.findAll({
      order: [['createdAt', 'DESC']]
    });

    console.log(`📦 Found ${jobs.length} jobs in PostgreSQL`);

    if (!jobs.length) {
      console.log('ℹ️ No jobs found to reindex');
      process.exit(0);
    }

    const chunks = chunkArray(jobs, 200);
    let indexedCount = 0;

    for (const chunk of chunks) {
      const operations = chunk.flatMap((job) => {
        const doc = toJobDocument(job);

        return [
          {
            index: {
              _index: JOBS_INDEX,
              _id: doc.id
            }
          },
          doc
        ];
      });

      const bulkResponse = await elasticClient.bulk({
        refresh: true,
        operations
      });

      if (bulkResponse.errors) {
        const erroredItems = [];

        bulkResponse.items.forEach((item, index) => {
          const operation = Object.keys(item)[0];
          const result = item[operation];

          if (result.error) {
            erroredItems.push({
              status: result.status,
              error: result.error,
              documentId: operations[index * 2]?.index?._id
            });
          }
        });

        console.error('❌ Some documents failed during bulk indexing');
        console.error(JSON.stringify(erroredItems, null, 2));
      }

      indexedCount += chunk.length;
      console.log(`✅ Indexed ${indexedCount}/${jobs.length} jobs`);
    }

    const countResult = await elasticClient.count({ index: JOBS_INDEX });
    console.log(`🎉 Elasticsearch jobs count: ${countResult.count}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Rebuild failed:', error);
    process.exit(1);
  }
};

rebuildJobsIndex();