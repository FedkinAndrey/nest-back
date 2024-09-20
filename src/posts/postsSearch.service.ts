import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import Post from './post.entity';
import PostSearchResult from './types/postSearchResponse.interface';
import PostSearchBody from './types/postSearchBody.interface';

@Injectable()
export default class PostsSearchService {
  index = 'posts';

  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async indexPost(post: Post) {
    return this.elasticsearchService.index<PostSearchBody>({
      index: this.index,
      document: {
        id: post.id,
        title: post.title,
        content: post.content,
        authorId: post.author.id,
      },
    });
  }

  async search(text: string) {
    const { hits } = await this.elasticsearchService.search<PostSearchResult>({
      index: this.index,
      query: {
        multi_match: {
          query: text,
          fields: ['title', 'content'],
        },
      },
    });
    const hitsResult = hits.hits;
    return hitsResult.map((item) => item._source as unknown as PostSearchBody);
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
      content: post.content,
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
      script: {
        source: script,
      },
    });
  }
}
