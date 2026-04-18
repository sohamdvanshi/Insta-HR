const { elasticClient } = require('../../config/elasticsearch');

const JOBS_INDEX = process.env.ELASTICSEARCH_JOBS_INDEX || 'jobs';

const ensureJobsIndex = async () => {
  const exists = await elasticClient.indices.exists({ index: JOBS_INDEX });

  if (exists) return;

  await elasticClient.indices.create({
    index: JOBS_INDEX,
    mappings: {
      properties: {
        id: { type: 'keyword' },
        employerId: { type: 'keyword' },

        title: {
          type: 'text',
          fields: {
            keyword: { type: 'keyword' },
            suggest: { type: 'search_as_you_type' }
          }
        },

        description: { type: 'text' },

        companyName: {
          type: 'text',
          fields: {
            keyword: { type: 'keyword' },
            suggest: { type: 'search_as_you_type' }
          }
        },

        location: {
          type: 'text',
          fields: {
            keyword: { type: 'keyword' },
            suggest: { type: 'search_as_you_type' }
          }
        },

        jobType: { type: 'keyword' },

        industry: {
          type: 'text',
          fields: {
            keyword: { type: 'keyword' },
            suggest: { type: 'search_as_you_type' }
          }
        },

        experienceLevel: { type: 'keyword' },
        status: { type: 'keyword' },
        currency: { type: 'keyword' },
        minExperienceYears: { type: 'integer' },
        salaryMin: { type: 'float' },
        salaryMax: { type: 'float' },

        minimumEducation: {
          type: 'text',
          fields: {
            keyword: { type: 'keyword' }
          }
        },

        requiredSkills: { type: 'keyword' },
        preferredSkills: { type: 'keyword' },
        responsibilities: { type: 'text' },
        qualifications: { type: 'text' },
        benefits: { type: 'text' },
        isFeatured: { type: 'boolean' },
        featuredUntil: { type: 'date' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
        applicationDeadline: { type: 'date' }
      }
    }
  });

  console.log(`✅ Elasticsearch index created: ${JOBS_INDEX}`);
};

const indexJobDocument = async (job) => {
  const doc = job.toJSON ? job.toJSON() : job;

  await elasticClient.index({
    index: JOBS_INDEX,
    id: doc.id,
    document: {
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
    },
    refresh: true
  });
};

const deleteJobDocument = async (jobId) => {
  try {
    await elasticClient.delete({
      index: JOBS_INDEX,
      id: jobId,
      refresh: true
    });
  } catch (error) {
    if (error.meta?.statusCode !== 404) {
      throw error;
    }
  }
};

const searchJobsAdvanced = async (params = {}) => {
  const {
    keyword = '',
    location = '',
    jobType = '',
    industry = '',
    experienceLevel = '',
    status = 'active',
    minSalary = '',
    sortBy = 'relevance',
    page = 1,
    limit = 10
  } = params;

  const pageNumber = Math.max(Number(page) || 1, 1);
  const limitNumber = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const from = (pageNumber - 1) * limitNumber;

  const must = [];
  const should = [];
  const filter = [];

  if (keyword && keyword.trim()) {
    const q = keyword.trim();

    must.push({
      multi_match: {
        query: q,
        type: 'bool_prefix',
        fields: [
          'title.suggest',
          'title.suggest._2gram',
          'title.suggest._3gram',
          'companyName.suggest',
          'companyName.suggest._2gram',
          'companyName.suggest._3gram',
          'location.suggest',
          'location.suggest._2gram',
          'location.suggest._3gram',
          'industry.suggest',
          'industry.suggest._2gram',
          'industry.suggest._3gram'
        ]
      }
    });

    should.push({
      multi_match: {
        query: q,
        fields: [
          'title^4',
          'companyName^3',
          'requiredSkills^3',
          'industry^2',
          'location^2',
          'description'
        ],
        type: 'best_fields',
        fuzziness: 'AUTO'
      }
    });
  }

  if (location && location.trim()) {
    must.push({
      match: {
        location: {
          query: location.trim(),
          fuzziness: 'AUTO'
        }
      }
    });
  }

  if (jobType) {
    filter.push({
      term: {
        jobType
      }
    });
  }

  if (industry && industry.trim()) {
    must.push({
      match: {
        industry: {
          query: industry.trim(),
          fuzziness: 'AUTO'
        }
      }
    });
  }

  if (experienceLevel) {
    filter.push({
      term: {
        experienceLevel
      }
    });
  }

  if (status) {
    filter.push({
      term: {
        status
      }
    });
  }

  if (minSalary !== '' && minSalary !== null && !Number.isNaN(Number(minSalary))) {
    filter.push({
      range: {
        salaryMax: {
          gte: Number(minSalary)
        }
      }
    });
  }

  const query = {
    bool: {
      must: must.length > 0 ? must : [{ match_all: {} }],
      filter,
      should
    }
  };

  let sort = [
    '_score',
    { isFeatured: { order: 'desc' } },
    { createdAt: { order: 'desc' } }
  ];

  if (sortBy === 'newest') {
    sort = [
      { isFeatured: { order: 'desc' } },
      { createdAt: { order: 'desc' } }
    ];
  } else if (sortBy === 'salaryHigh') {
    sort = [
      { isFeatured: { order: 'desc' } },
      { salaryMax: { order: 'desc', missing: '_last' } },
      { createdAt: { order: 'desc' } }
    ];
  } else if (sortBy === 'salaryLow') {
    sort = [
      { isFeatured: { order: 'desc' } },
      { salaryMin: { order: 'asc', missing: '_last' } },
      { createdAt: { order: 'desc' } }
    ];
  }

  const response = await elasticClient.search({
    index: JOBS_INDEX,
    from,
    size: limitNumber,
    query,
    sort
  });

  const total =
    typeof response.hits.total === 'number'
      ? response.hits.total
      : response.hits.total?.value || 0;

  const hits = response.hits.hits.map((hit) => ({
    id: hit._id,
    score: hit._score,
    ...hit._source
  }));

  return {
    total,
    currentPage: pageNumber,
    totalPages: Math.ceil(total / limitNumber),
    data: hits
  };
};

module.exports = {
  JOBS_INDEX,
  ensureJobsIndex,
  indexJobDocument,
  deleteJobDocument,
  searchJobsAdvanced
};