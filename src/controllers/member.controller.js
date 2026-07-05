import Member from '../models/member.model.js';
import User from '../models/user.model.js';
import { sendSuccess, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { notFoundError, conflictError } from '../utils/AppError.js';

// Generate next member ID (e.g., MEM-001)
const generateMemberId = async () => {
  const count = await Member.countDocuments();
  return `MEM-${String(count + 1).padStart(3, '0')}`;
};

export const getMembers = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { search, status } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const [members, total] = await Promise.all([
      Member.find(filter).populate('userId', 'displayName email role').populate('roomId', 'roomNumber').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Member.countDocuments(filter),
    ]);

    // If search query, filter after populate (userId.displayName, email)
    const filtered = search
      ? members.filter((m) =>
          m.userId?.displayName?.toLowerCase().includes(search.toLowerCase()) ||
          m.userId?.email?.toLowerCase().includes(search.toLowerCase()) ||
          m.memberId?.toLowerCase().includes(search.toLowerCase())
        )
      : members;

    sendSuccess(res, filtered, 'Members retrieved', 200, buildPagination(page, limit, total));
  } catch (err) { next(err); }
};

export const getMemberById = async (req, res, next) => {
  try {
    const member = await Member.findById(req.params.id).populate('roomId');
    if (!member) return next(notFoundError('Member'));
    sendSuccess(res, member, 'Member retrieved');
  } catch (err) { next(err); }
};

export const createMember = async (req, res, next) => {
  try {
    const existing = await Member.findOne({ userId: req.body.userId });
    if (existing) return next(conflictError('A member profile already exists for this user'));
    const memberId = await generateMemberId();
    const member = await Member.create({ ...req.body, memberId });
    sendSuccess(res, member, 'Member created', 201);
  } catch (err) { next(err); }
};

export const updateMember = async (req, res, next) => {
  try {
    const member = await Member.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!member) return next(notFoundError('Member'));
    sendSuccess(res, member, 'Member updated');
  } catch (err) { next(err); }
};

export const deleteMember = async (req, res, next) => {
  try {
    const member = await Member.findByIdAndDelete(req.params.id);
    if (!member) return next(notFoundError('Member'));
    sendSuccess(res, null, 'Member deleted');
  } catch (err) { next(err); }
};

export const getMyProfile = async (req, res, next) => {
  try {
    const member = await Member.findOne({ userId: req.user._id }).populate('roomId');
    if (!member) {
      // Return a 200 with null or an empty object so the client can show an empty form
      return sendSuccess(res, null, 'No member profile found');
    }
    sendSuccess(res, member, 'Profile retrieved');
  } catch (err) { next(err); }
};

export const updateMyProfile = async (req, res, next) => {
  try {
    const { phone, emergencyContact, nid, occupation } = req.body;
    let member = await Member.findOne({ userId: req.user._id });

    if (member) {
      member.phone = phone;
      member.emergencyContact = emergencyContact;
      member.nid = nid;
      member.occupation = occupation;
      await member.save();
    } else {
      const memberId = await generateMemberId();
      member = await Member.create({
        userId: req.user._id,
        memberId,
        phone,
        emergencyContact,
        nid,
        occupation,
      });
    }
    
    // Also update User display name if provided
    if (req.body.displayName) {
      await User.findByIdAndUpdate(req.user._id, { displayName: req.body.displayName });
    }

    sendSuccess(res, member, 'Profile updated successfully');
  } catch (err) { next(err); }
};
