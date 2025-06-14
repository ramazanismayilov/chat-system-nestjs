import { Column, CreateDateColumn, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { MessageStatus } from "src/common/enums/messageStatus.enum";
import { MediaEntity } from "./Media.entity";
import { UserEntity } from "./User.entity";
import { ChatEntity } from "./Chat.entity";

@Entity('message')
export class MessageEntity {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    text: string

    @ManyToOne(() => MediaEntity, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'mediaId' })
    media: MediaEntity | null;

    @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
    user: UserEntity

    @ManyToOne(() => ChatEntity, (chat) => chat.messages, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'chatId' })
    chat: ChatEntity

    @ManyToMany(() => UserEntity)
    @JoinTable({ name: 'user_deletedMessage' })
    deletedBy: UserEntity[];

    @Column({ type: 'enum', enum: MessageStatus, default: MessageStatus.SENT })
    status: MessageStatus;

    @CreateDateColumn({ 'type': 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}