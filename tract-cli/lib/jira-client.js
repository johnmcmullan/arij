const axios = require('axios');

class JiraClient {
  constructor(baseUrl, auth) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.auth = auth;
    this.client = axios.create({
      baseURL: this.baseUrl,
      auth: this.auth,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async getProject(projectKey) {
    const response = await this.client.get(`/rest/api/2/project/${projectKey}`);
    return response.data;
  }

  async getProjectComponents(projectKey) {
    const response = await this.client.get(`/rest/api/2/project/${projectKey}/components`);
    return response.data;
  }

  async getProjectStatuses(projectKey) {
    const response = await this.client.get(`/rest/api/2/project/${projectKey}/statuses`);
    return response.data;
  }

  async getIssueTypes(projectKey) {
    // Get from project endpoint which includes issue types
    const project = await this.getProject(projectKey);
    return project.issueTypes || [];
  }

  async getPriorities() {
    const response = await this.client.get('/rest/api/2/priority');
    return response.data;
  }

  async getCustomFields() {
    const response = await this.client.get('/rest/api/2/field');
    return response.data.filter(field => field.custom);
  }

  async searchIssues(jql, maxResults = null) {
    const params = {
      jql,
      fields: '*all',
      expand: 'changelog,renderedFields'
    };

    if (maxResults) {
      params.maxResults = maxResults;
    }

    const allIssues = [];
    let startAt = 0;
    const batchSize = maxResults || 100;

    while (true) {
      params.startAt = startAt;
      params.maxResults = batchSize;

      const response = await this.client.get('/rest/api/2/search', { params });
      const { issues, total } = response.data;
      
      allIssues.push(...issues);
      
      if (maxResults && allIssues.length >= maxResults) {
        return allIssues.slice(0, maxResults);
      }

      if (allIssues.length >= total) {
        break;
      }

      startAt += batchSize;
    }

    return allIssues;
  }

  async getProjectMetadata(projectKey) {
    console.log(`  Fetching project details...`);
    const project = await this.getProject(projectKey);

    console.log(`  Fetching components...`);
    const components = await this.getProjectComponents(projectKey);

    console.log(`  Fetching statuses...`);
    const statusData = await this.getProjectStatuses(projectKey);
    
    // Extract unique statuses across all issue types
    const statusSet = new Set();
    statusData.forEach(issueTypeStatus => {
      issueTypeStatus.statuses.forEach(status => {
        statusSet.add(status.name);
      });
    });
    const statuses = Array.from(statusSet);

    console.log(`  Fetching priorities...`);
    const priorities = await this.getPriorities();

    console.log(`  Fetching custom fields...`);
    const customFields = await this.getCustomFields();

    return {
      project,
      components,
      statuses,
      issueTypes: project.issueTypes || [],
      priorities,
      customFields
    };
  }
}

module.exports = JiraClient;
