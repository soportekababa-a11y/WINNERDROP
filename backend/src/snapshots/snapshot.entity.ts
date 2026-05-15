import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Product } from '../products/product.entity';

@Entity('snapshots')
@Index(['productId', 'capturedAt'])
export class Snapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productId: string;

  @ManyToOne(() => Product, (p) => p.snapshots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  // Ventas acumuladas totales en el momento del snapshot (el número de Effi)
  @Column({ default: 0 })
  salesAccum: number;

  @Column({ type: 'float', default: 0 })
  price: number;

  @Column({ default: 0 })
  stock: number;

  @CreateDateColumn()
  capturedAt: Date;
}
