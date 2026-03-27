import MockAdapter from "axios-mock-adapter";
import api, { authApi, receiptsApi } from "./api";

describe("api client", () => {
  test("attaches bearer token from localStorage", async () => {
    const mock = new MockAdapter(api);
    localStorage.setItem("token", "abc123");
    mock.onGet("/auth/me").reply(200, { id: 1 });

    await authApi.me();

    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].headers.Authorization).toBe("Bearer abc123");
    mock.restore();
  });

  test("uses the expected receipts update endpoint and payload", async () => {
    const mock = new MockAdapter(api);
    const payload = {
      items: [{ id: 1, name: "Milk", quantity: 1, unit_price: 3.5, category_id: 2 }],
      deleted_item_ids: [],
    };
    mock.onPut("/receipts/9/items").reply(200, { ok: true });

    const res = await receiptsApi.updateItems(9, payload);

    expect(res.status).toBe(200);
    expect(mock.history.put).toHaveLength(1);
    expect(mock.history.put[0].url).toBe("/receipts/9/items");
    expect(JSON.parse(mock.history.put[0].data)).toEqual(payload);
    mock.restore();
  });
});
