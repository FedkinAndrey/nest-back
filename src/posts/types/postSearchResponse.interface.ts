import PostSearchBody from './postSearchBody.interface';

interface PostSearchResult {
  hits: {
    total: {
      value: number;
    };
    hits: Array<{
      _source: PostSearchBody; // Ensure _source matches your expected document structure
    }>;
  };
}

export default PostSearchResult;
