import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Unique } from 'typeorm';
import { Snapshot } from '../snapshots/snapshot.entity';

@Entity('products')
@Unique(['effiId', 'country'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  effiId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ nullable: true })
  provider: string;

  @Column({ nullable: true })
  category: string;

  @Column({ nullable: true })
  subcategory: string;

  @Column({ type: 'float', default: 0 })
  price: number;

  @Column({ type: 'float', default: 0 })
  cost: number;

  @Column({ default: 0 })
  stock: number;

  @Column({ default: 0 })
  totalSalesAccum: number;

  @Column({ default: 0 })
  salesToday: number;

  @Column({ default: 0 })
  salesYesterday: number;

  @Column({ default: 0 })
  salesBaseline: number;

  @Column({ type: 'date', nullable: true })
  salesBaselineDate: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 'RD' })
  country: string;

  @Column({ default: 'effi' })
  platform: string;

  @OneToMany(() => Snapshot, (s) => s.product)
  snapshots: Snapshot[];

  @UpdateDateColumn()
  updatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
