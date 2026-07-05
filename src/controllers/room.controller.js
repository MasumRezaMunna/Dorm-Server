import Room from '../models/room.model.js';
import Member from '../models/member.model.js';
import { sendSuccess, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { notFoundError, AppError } from '../utils/AppError.js';
import { createNotification } from './notification.controller.js';

export const getRooms = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { status, floor } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (floor) filter.floor = Number(floor);
    const [rooms, total] = await Promise.all([
      Room.find(filter).populate({ path: 'members', populate: { path: 'userId', select: 'displayName email photoURL' } }).sort({ roomNumber: 1 }).skip(skip).limit(limit),
      Room.countDocuments(filter),
    ]);
    sendSuccess(res, rooms, 'Rooms retrieved', 200, buildPagination(page, limit, total));
  } catch (err) { next(err); }
};

export const getRoomById = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id).populate({ path: 'members', populate: { path: 'userId', select: 'displayName email photoURL' } });
    if (!room) return next(notFoundError('Room'));
    sendSuccess(res, room, 'Room retrieved');
  } catch (err) { next(err); }
};

export const createRoom = async (req, res, next) => {
  try {
    const room = await Room.create(req.body);
    sendSuccess(res, room, 'Room created', 201);
  } catch (err) { next(err); }
};

export const updateRoom = async (req, res, next) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!room) return next(notFoundError('Room'));
    sendSuccess(res, room, 'Room updated');
  } catch (err) { next(err); }
};

export const deleteRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return next(notFoundError('Room'));
    if (room.members.length > 0) return next(new AppError('Cannot delete a room with assigned members', 400));
    await room.deleteOne();
    sendSuccess(res, null, 'Room deleted');
  } catch (err) { next(err); }
};

export const assignMember = async (req, res, next) => {
  try {
    const { memberId } = req.body;
    const room = await Room.findById(req.params.id);
    if (!room) return next(notFoundError('Room'));
    if (room.members.length >= room.capacity) return next(new AppError('Room is at full capacity', 400));
    if (room.members.includes(memberId)) return next(new AppError('Member already assigned to this room', 409));
    // Remove from previous room if any
    await Room.updateMany({ members: memberId }, { $pull: { members: memberId } });
    room.members.push(memberId);
    await room.save();
    // Update member's roomId
    const member = await Member.findByIdAndUpdate(memberId, { roomId: room._id });
    if (member) {
      createNotification(member.userId, 'Room Assigned', `You have been assigned to Room ${room.roomNumber}`, 'system', '/member/room');
    }
    
    sendSuccess(res, room, 'Member assigned to room');
  } catch (err) { next(err); }
};

export const vacateMember = async (req, res, next) => {
  try {
    const { memberId } = req.body;
    const room = await Room.findByIdAndUpdate(req.params.id, { $pull: { members: memberId } }, { new: true });
    if (!room) return next(notFoundError('Room'));
    const member = await Member.findByIdAndUpdate(memberId, { roomId: null });
    if (member) {
      createNotification(member.userId, 'Room Vacated', `You have been vacated from Room ${room.roomNumber}`, 'system', '/member/room');
    }
    sendSuccess(res, room, 'Member vacated from room');
  } catch (err) { next(err); }
};
