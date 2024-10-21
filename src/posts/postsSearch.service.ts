import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import Post from './post.entity';
import PostSearchResult from './types/postSearchResponse.interface';
import PostSearchBody from './types/postSearchBody.interface';

@Injectable()
export default class PostsSearchService {
  index = 'posts';

  constructor(private readonly elasticsearchService: ElasticsearchService) {
    this.createIndexIfNotExists();
  }

  async createIndexIfNotExists() {
    const indexExists = await this.elasticsearchService.indices.exists({
      index: this.index,
    });
    if (!indexExists) {
      await this.elasticsearchService.indices.create({
        index: this.index,
        mappings: {
          properties: {
            id: { type: 'integer' },
            title: { type: 'text' },
            paragraphs: { type: 'text' },
            authorId: { type: 'integer' },
          },
        },
      });
      console.log(`Created index [${this.index}] with mappings.`);
    }
  }

  async indexPost(post: Post) {
    return this.elasticsearchService.index<PostSearchBody>({
      index: this.index,
      document: {
        id: post.id,
        title: post.title,
        paragraphs: post.paragraphs,
        authorId: post.author.id,
      },
    });
  }

  async count(query: string, fields: string[]) {
    const doc = await this.elasticsearchService.count({
      index: this.index,
      query: {
        multi_match: {
          query,
          fields,
        },
      },
    });
    return doc.count;
  }

  async search(text: string, offset?: number, limit?: number, startId = 0) {
    let separateCount = 0;
    if (startId) {
      separateCount = await this.count(text, ['title', 'paragraphs']);
    }
    const document = await this.elasticsearchService.search<PostSearchResult>({
      index: this.index,
      from: offset,
      size: limit,
      query: {
        bool: {
          must: {
            multi_match: {
              query: text,
              fields: ['title', 'paragraphs'],
              type: 'phrase',
            },
          },
          filter: {
            range: {
              id: {
                gt: startId,
              },
            },
          },
        },
      },
      sort: {
        id: {
          order: 'asc',
        },
      },
    });

    console.log('document', document);

    const count =
      typeof document.hits.total === 'number'
        ? document.hits.total
        : document.hits.total.value;

    const hits = document.hits.hits;
    const results = hits.map(
      (item) => item._source as unknown as PostSearchBody,
    ); // Map each hit to its _source

    return {
      count: startId ? separateCount : count,
      results,
    };
  }

  async remove(postId: number) {
    await this.elasticsearchService.deleteByQuery({
      index: this.index,
      query: {
        match: {
          id: postId,
        },
      },
    });
  }

  async update(post: Post) {
    const newBody: PostSearchBody = {
      id: post.id,
      title: post.title,
      paragraphs: post.paragraphs,
      authorId: post.author.id,
    };

    const script = Object.entries(newBody).reduce((result, [key, value]) => {
      return `${result} ctx._source.${key}='${value}';`;
    }, '');

    return this.elasticsearchService.updateByQuery({
      index: this.index,
      query: {
        match: {
          id: post.id,
        },
      },
      script: script,
    });
  }
}
