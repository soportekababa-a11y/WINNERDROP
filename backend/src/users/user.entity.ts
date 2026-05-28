import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum Plan {
  FREE = 'free',
  BASIC = 'basic',
  PRO = 'pro',
  PREMIUM = 'premium',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  name: string;

  @Column({ type: 'varchar', default: Plan.FREE })
  plan: Plan;

  @Column({ nullable: true, type: 'timestamptz' })
  planExpiresAt: Date;

  @Column({ nullable: true, type: 'timestamptz' })
  planActivatedAt: Date;

  @Column({ nullable: true })
  selectedCountry: string;

  @Column({ nullable: true })
  selectedPlatform: string;

  @Column({ nullable: true })
  sessionToken: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
