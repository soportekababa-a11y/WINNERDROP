import { Injectable } from '@nestjs/common';
import { ImageSearchProvider } from './providers/image-search.provider';

@Injectable()
export class CompetitorSpyService {
  constructor(private readonly imageSearch: ImageSearchProvider) {}

  async findCompetitors(productName: string): Promise<{ competitors: string[] }> {
    const competitors = await this.imageSearch.findCompetitors(productName);
    return { competitors };
  }
}
