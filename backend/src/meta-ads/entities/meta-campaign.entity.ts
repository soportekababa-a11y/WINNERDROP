import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('meta_campaigns')
export class MetaCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  metaConnectionId: string;

  @Column({ nullable: true })
  fbCampaignId: string;

  @Column({ nullable: true })
  fbAdSetId: string;

  @Column()
  name: string;

  @Column()
  objective: string;

  @Column({ default: 'PAUSED' })
  status: string;

  @Column({ nullable: true, type: 'decimal' })
  dailyBudget: number;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true, type: 'text' })
  aiData: string;

  @CreateDateColumn()
  createdAt: Date;
}
