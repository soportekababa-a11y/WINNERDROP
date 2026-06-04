import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('meta_connections')
export class MetaConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  fbUserId: string;

  @Column({ type: 'text', nullable: true })
  accessToken: string;

  @Column({ nullable: true, type: 'timestamptz' })
  tokenExpiresAt: Date;

  @Column({ nullable: true })
  adAccountId: string;

  @Column({ nullable: true })
  adAccountName: string;

  @Column({ nullable: true })
  pageId: string;

  @Column({ nullable: true })
  pageName: string;

  @Column({ default: false })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
