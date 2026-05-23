import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('shopify_stores')
export class ShopifyStore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ unique: true })
  shopDomain: string;

  @Column()
  accessToken: string;

  @Column({ nullable: true })
  webhookId: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', default: '¡Hola {{nombre}}! Gracias por tu pedido #{{numero}} en {{tienda}}. Lo estamos procesando. 🛍️' })
  messageTemplate: string;

  @Column({ nullable: true })
  whatsappTemplateName: string;

  @Column({ default: 'es' })
  whatsappLanguage: string;

  @Column({ default: false })
  whatsappEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
