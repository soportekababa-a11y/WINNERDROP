import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Snapshot } from '../snapshots/snapshot.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
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

  // Ventas acumuladas (el número que muestra Effi)
  @Column({ default: 0 })
  totalSalesAccum: number;

  // Cache de ventas de hoy (delta calculado desde snapshots)
  @Column({ default: 0 })
  salesToday: number;

  // Cache de ventas de ayer
  @Column({ default: 0 })
  salesYesterday: number;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Snapshot, (s) => s.product)
  snapshots: Snapshot[];

  @UpdateDateColumn()
  updatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
