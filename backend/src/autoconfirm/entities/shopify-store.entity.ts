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

  @Column({ type: 'text', default: 'Hola {{nombre}}, te escribimos de *{{tienda}}* 👋\n\nRecibimos tu pedido *#{{numero}}*:\n🛍️ {{productos}}\n📍 {{ciudad}}\n💰 {{precio}}\n\n¿Confirmas tu pedido?' })
  messageTemplate: string;

  @Column({ type: 'text', default: '✅ ¡Perfecto {{nombre}}! Tu pedido #{{numero}} ha sido confirmado. Pronto te llegará. 🚀' })
  confirmMessage: string;

  @Column({ type: 'text', default: '❌ Tu pedido #{{numero}} ha sido cancelado. Si tienes dudas escríbenos. 😊' })
  cancelMessage: string;

  @Column({ nullable: true })
  whatsappTemplateName: string;

  @Column({ default: 'es' })
  whatsappLanguage: string;

  @Column({ default: false })
  whatsappEnabled: boolean;

  @Column({ nullable: true })
  whatsappPhoneNumberId: string;

  @Column({ nullable: true, select: false })
  whatsappAccessToken: string;

  @Column({ nullable: true })
  labelPendingId: string;

  @Column({ nullable: true })
  labelConfirmedId: string;

  @Column({ nullable: true })
  labelCancelledId: string;

  // 'text_only' | 'text_and_audio'
  @Column({ default: 'text_only' })
  audioInitialMode: string;

  // 'text' | 'audio'
  @Column({ default: 'text' })
  audioConfirmMode: string;

  // 'text' | 'audio'
  @Column({ default: 'text' })
  audioCancelMode: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
