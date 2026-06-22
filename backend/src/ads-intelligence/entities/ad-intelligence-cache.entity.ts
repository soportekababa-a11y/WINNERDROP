import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('ad_intelligence_cache')
export class AdIntelligenceCache {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  cacheKey: string;

  @Column()
  productName: string;

  @Column()
  country: string;

  @Column({ type: 'jsonb' })
  results: object;

  @Column({ type: 'jsonb', nullable: true })
  queries: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
