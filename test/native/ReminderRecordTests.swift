import Foundation

@main
struct ReminderRecordTests {
  static func main() throws {
    let now: Double = 1000000
    let input = HandyReminderRecord.Input(id: "reminder-123", text: "  Pick something up from the store\nwhile out.  ", intervalMinutes: 60, repeats: true)
    var record = try HandyReminderRecord(input, now: now, revision: "revision-123")
    precondition(record.intervalSeconds == 3600 && record.repeats)
    precondition(record.status == .scheduling && record.firstFireAt == nil)
    precondition(record.text == "Pick something up from the store\nwhile out.")
    precondition(record.matches(input))
    try record.preparing(at: now)
    precondition(record.firstFireAt == now + 3600000, "Default first notification is one hour from scheduling")
    let requestId = record.requestId
    try record.activate()
    let restored = try JSONDecoder().decode(HandyReminderRecord.self, from: JSONEncoder().encode(record))
    precondition(restored == record && restored.requestId == requestId, "Restart/retry must retain trigger identity and first due time")
    var pending = try HandyReminderRecord(input, now: now, revision: "pending-123")
    try pending.preparing(at: now)
    let prepared = try JSONDecoder().decode(HandyReminderRecord.self, from: JSONEncoder().encode(pending))
    precondition(prepared.status == .scheduling && prepared.requestId == pending.requestId, "A crash during scheduling remains recoverable")
    let before = record
    do { try record.complete(revision: "stale-revision", at: now); preconditionFailure("Stale actions must fail") }
    catch { precondition(record == before) }
    try record.complete(revision: record.revision, at: now + 10)
    let completed = record
    try record.complete(revision: record.revision, at: now + 999)
    precondition(record == completed, "Duplicate native/JS completion must not change the original completion")
    do { try record.preparing(at: now + 1000); preconditionFailure("Completed reminders cannot rearm") } catch { }
    do { try record.activate(); preconditionFailure("Completed reminders cannot reactivate") } catch { }
    precondition(record.status == .completed && record.completedAt == now + 10)
    var completedBeforeSchedule = pending
    try completedBeforeSchedule.complete(revision: pending.revision, at: now)
    do { try completedBeforeSchedule.activate(); preconditionFailure("Completion wins a scheduling race") } catch { }
    for minutes in [1, 90, 1440, 525600] {
      let once = try HandyReminderRecord(.init(id: "once-\(minutes)", text: "One time", intervalMinutes: minutes, repeats: false), now: now)
      precondition(!once.repeats && once.intervalSeconds == Double(minutes) * 60)
    }
    for minutes in [-1, 0, 525601] {
      do { _ = try HandyReminderRecord(.init(id: "invalid", text: "Task", intervalMinutes: minutes, repeats: true), now: now); preconditionFailure("Invalid intervals must fail before scheduling") } catch { }
    }
    for text in [" \n ", String(repeating: "x", count: 2001)] {
      do { _ = try HandyReminderRecord(.init(id: "invalid", text: text, intervalMinutes: 60, repeats: true), now: now); preconditionFailure("Invalid text must not schedule") } catch { }
    }
    print("Native reminders passed: hourly/default/custom intervals, durable scheduling identity, restart, stale/duplicate completion, and no rearming after completion.")
  }
}
