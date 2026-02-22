import { describe, it, expect, beforeEach } from 'vitest';

import { _initTestDatabase, getAllChats, storeChatMetadata } from './db.js';
import { getAvailableGroups, _setRegisteredGroups } from './index.js';

beforeEach(() => {
  _initTestDatabase();
  _setRegisteredGroups({});
});

// --- JID ownership patterns ---

describe('JID ownership patterns', () => {
  it('Telegram JID: starts with tg:', () => {
    const jid = 'tg:123456789';
    expect(jid.startsWith('tg:')).toBe(true);
  });

  it('Telegram group JID: starts with tg: and has negative ID', () => {
    const jid = 'tg:-1001234567890';
    expect(jid.startsWith('tg:')).toBe(true);
  });
});

// --- getAvailableGroups ---

describe('getAvailableGroups', () => {
  it('returns only groups, excludes DMs', () => {
    storeChatMetadata('tg:-100111', '2024-01-01T00:00:01.000Z', 'Group 1', 'telegram', true);
    storeChatMetadata('tg:9999', '2024-01-01T00:00:02.000Z', 'User DM', 'telegram', false);
    storeChatMetadata('tg:-100222', '2024-01-01T00:00:03.000Z', 'Group 2', 'telegram', true);

    const groups = getAvailableGroups();
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.jid)).toContain('tg:-100111');
    expect(groups.map((g) => g.jid)).toContain('tg:-100222');
    expect(groups.map((g) => g.jid)).not.toContain('tg:9999');
  });

  it('excludes __group_sync__ sentinel', () => {
    storeChatMetadata('__group_sync__', '2024-01-01T00:00:00.000Z');
    storeChatMetadata('tg:-100123', '2024-01-01T00:00:01.000Z', 'Group', 'telegram', true);

    const groups = getAvailableGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].jid).toBe('tg:-100123');
  });

  it('marks registered groups correctly', () => {
    storeChatMetadata('tg:-100111', '2024-01-01T00:00:01.000Z', 'Registered', 'telegram', true);
    storeChatMetadata('tg:-100222', '2024-01-01T00:00:02.000Z', 'Unregistered', 'telegram', true);

    _setRegisteredGroups({
      'tg:-100111': {
        name: 'Registered',
        folder: 'registered',
        trigger: '@Andy',
        added_at: '2024-01-01T00:00:00.000Z',
      },
    });

    const groups = getAvailableGroups();
    const reg = groups.find((g) => g.jid === 'tg:-100111');
    const unreg = groups.find((g) => g.jid === 'tg:-100222');

    expect(reg?.isRegistered).toBe(true);
    expect(unreg?.isRegistered).toBe(false);
  });

  it('returns groups ordered by most recent activity', () => {
    storeChatMetadata('tg:-100001', '2024-01-01T00:00:01.000Z', 'Old', 'telegram', true);
    storeChatMetadata('tg:-100005', '2024-01-01T00:00:05.000Z', 'New', 'telegram', true);
    storeChatMetadata('tg:-100003', '2024-01-01T00:00:03.000Z', 'Mid', 'telegram', true);

    const groups = getAvailableGroups();
    expect(groups[0].jid).toBe('tg:-100005');
    expect(groups[1].jid).toBe('tg:-100003');
    expect(groups[2].jid).toBe('tg:-100001');
  });

  it('excludes non-group chats regardless of JID format', () => {
    // Unknown JID format stored without is_group should not appear
    storeChatMetadata('unknown-format-123', '2024-01-01T00:00:01.000Z', 'Unknown');
    // Explicitly non-group
    storeChatMetadata('tg:9999', '2024-01-01T00:00:02.000Z', 'DM', 'telegram', false);
    // A real group for contrast
    storeChatMetadata('tg:-100100', '2024-01-01T00:00:03.000Z', 'Group', 'telegram', true);

    const groups = getAvailableGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].jid).toBe('tg:-100100');
  });

  it('returns empty array when no chats exist', () => {
    const groups = getAvailableGroups();
    expect(groups).toHaveLength(0);
  });

  it('includes Telegram chat JIDs', () => {
    storeChatMetadata('tg:100200300', '2024-01-01T00:00:01.000Z', 'Telegram Chat', 'telegram', true);
    storeChatMetadata('user@s.whatsapp.net', '2024-01-01T00:00:02.000Z', 'User DM', 'whatsapp', false);

    const groups = getAvailableGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].jid).toBe('tg:100200300');
  });

  it('returns Telegram group JIDs with negative IDs', () => {
    storeChatMetadata('tg:-1001234567890', '2024-01-01T00:00:01.000Z', 'TG Group', 'telegram', true);

    const groups = getAvailableGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].jid).toBe('tg:-1001234567890');
    expect(groups[0].name).toBe('TG Group');
  });

  it('marks registered Telegram chats correctly', () => {
    storeChatMetadata('tg:100200300', '2024-01-01T00:00:01.000Z', 'TG Registered', 'telegram', true);
    storeChatMetadata('tg:999999', '2024-01-01T00:00:02.000Z', 'TG Unregistered', 'telegram', true);

    _setRegisteredGroups({
      'tg:100200300': {
        name: 'TG Registered',
        folder: 'tg-registered',
        trigger: '@Andy',
        added_at: '2024-01-01T00:00:00.000Z',
      },
    });

    const groups = getAvailableGroups();
    const tgReg = groups.find((g) => g.jid === 'tg:100200300');
    const tgUnreg = groups.find((g) => g.jid === 'tg:999999');

    expect(tgReg?.isRegistered).toBe(true);
    expect(tgUnreg?.isRegistered).toBe(false);
  });

  it('returns multiple Telegram groups ordered by activity', () => {
    storeChatMetadata('tg:-100001', '2024-01-01T00:00:01.000Z', 'Chat 1', 'telegram', true);
    storeChatMetadata('tg:-100003', '2024-01-01T00:00:03.000Z', 'Chat 3', 'telegram', true);
    storeChatMetadata('tg:-100002', '2024-01-01T00:00:02.000Z', 'Chat 2', 'telegram', true);

    const groups = getAvailableGroups();
    expect(groups).toHaveLength(3);
    expect(groups[0].jid).toBe('tg:-100003');
    expect(groups[1].jid).toBe('tg:-100002');
    expect(groups[2].jid).toBe('tg:-100001');
  });
});
