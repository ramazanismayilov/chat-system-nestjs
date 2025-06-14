import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { ChatEntity } from "src/entities/Chat.entity";
import { DataSource, In, Repository } from "typeorm";
import { CreateChatDto } from "./dto/create-chat.dto";
import { ClsService } from "nestjs-cls";
import { UserEntity } from "src/entities/User.entity";
import { ChatParticipantEntity } from "src/entities/Participiant.entity";
import { MessageService } from "../message/message.service";
import { MediaEntity } from "src/entities/Media.entity";

@Injectable()
export class ChatService {
    private chatRepo: Repository<ChatEntity>
    private userRepo: Repository<UserEntity>
    private mediaRepo: Repository<MediaEntity>
    private chatParticipantRepo: Repository<ChatParticipantEntity>

    constructor(
        private cls: ClsService,
        private messageService: MessageService,
        @InjectDataSource() private dataSource: DataSource
    ) {
        this.chatRepo = this.dataSource.getRepository(ChatEntity)
        this.userRepo = this.dataSource.getRepository(UserEntity)
        this.mediaRepo = this.dataSource.getRepository(MediaEntity)
        this.chatParticipantRepo = this.dataSource.getRepository(ChatParticipantEntity)
    }

    async getUserChats() {
        const currentUser = this.cls.get<UserEntity>('user');

        const userChats = await this.chatRepo
            .createQueryBuilder('chat')
            .leftJoinAndSelect('chat.participants', 'participant')
            .leftJoinAndSelect('participant.user', 'user')
            .leftJoinAndSelect('user.profile', 'profile')
            .leftJoinAndSelect('profile.avatar', 'avatar')
            .leftJoinAndSelect('chat.lastMessage', 'lastMessage')
            .leftJoinAndSelect('lastMessage.user', 'lastMessageUser')
            .where(qb => {
                const subQuery = qb
                    .subQuery()
                    .select('cp.chatId')
                    .from('chat_participant', 'cp')
                    .where('cp.userId = :userId')
                    .getQuery();
                return 'chat.id IN ' + subQuery;
            })
            .setParameter('userId', currentUser.id)
            .orderBy('chat.updatedAt', 'DESC')
            .getMany();

        const chatsWithOtherUsers = userChats.map(chat => {
            const otherParticipants = chat.participants
                .filter(p => p.user.id !== currentUser.id)
                .map(p => ({
                    id: p.user.id,
                    displayName: p.user.displayName,
                    unreadMessageCount: p.unreadMessageCount,
                    profile: {
                        avatar: p.user.profile?.avatar ?? null,
                    },
                }));

            return {
                id: chat.id,
                participants: otherParticipants,
                lastMessage: chat.lastMessage
                    ? {
                        id: chat.lastMessage.id,
                        text: chat.lastMessage.text,
                        createdAt: chat.lastMessage.createdAt,
                    }
                    : null
            };
        });

        return { userChats: chatsWithOtherUsers };
    }

    async createChat(params: CreateChatDto) {
        const currentUser = this.cls.get<UserEntity>('user');
        if (params.userId === currentUser.id) throw new BadRequestException('You cannot send message to yourself');

        const targetUser = await this.userRepo.findOne({ where: { id: params.userId } });
        if (!targetUser) throw new NotFoundException('User not found');

        if (params.mediaId) {
            const media = await this.mediaRepo.findOne({ where: { id: params.mediaId } });
            if (!media) throw new NotFoundException('Media not found');
        }

        let myChats = await this.chatRepo
            .createQueryBuilder('c')
            .leftJoin('c.participants', 'myParticipant')
            .leftJoinAndSelect('c.participants', 'participants')
            .leftJoinAndSelect('participants.user', 'user')
            .andWhere('myParticipant.userId = :userId', { userId: currentUser.id })
            .getMany();

        let chat = myChats.find(chat => chat.participants.some(p => p.user.id === params.userId));
        if (chat) {
            throw new BadRequestException('Chat already exists')
        } else {
            let participants: ChatParticipantEntity[] = [];
            chat = this.chatRepo.create();
            chat = await this.chatRepo.save(chat);
            participants.push(this.chatParticipantRepo.create({ user: { id: params.userId }, chat }));
            participants.push(this.chatParticipantRepo.create({ user: { id: currentUser.id }, chat }));
            await this.chatParticipantRepo.save(participants);
        }

        await this.messageService.createMessage(chat.id, { text: params.text });
        return { message: 'Chat created successfully' };
    }

    async deleteChat(){}
}