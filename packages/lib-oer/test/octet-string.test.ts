import { describe, test } from "vitest"

import { sequenceOf, uint8Number, uint32Number } from "../src"
import { octetString } from "../src/octet-string"
import { hexToUint8Array } from "../src/utils/hex"
import { parsedOk, serializedOk } from "./utils/result"
import { sampleBuffer } from "./utils/sample-buffer"
import { addLengthPrefix } from "./utils/sample-length-prefix"

describe("octetString", () => {
  test("should be a function", ({ expect }) => {
    expect(octetString).toBeTypeOf("function")
  })

  describe("with fixed length", () => {
    const schema = octetString(22)

    test("should return an object", ({ expect }) => {
      expect(schema).toBeTypeOf("object")
    })

    test("should serialize a valid value", ({ expect }) => {
      const value = schema.serialize(sampleBuffer.slice(0, 22))
      expect(value).toEqual(serializedOk(sampleBuffer.slice(0, 22)))
    })

    test("should parse a valid value", ({ expect }) => {
      const value = schema.parse(sampleBuffer.slice(0, 22))
      expect(value).toEqual(parsedOk(22, sampleBuffer.slice(0, 22)))
    })

    test("should refuse to serialize a value of the wrong length", ({
      expect,
    }) => {
      const value = schema.serialize(sampleBuffer.slice(0, 21))
      expect(value).toMatchSnapshot()
    })
  })

  describe("with variable length", () => {
    const schema = octetString()

    test("should return an object", ({ expect }) => {
      expect(schema).toBeTypeOf("object")
    })

    test("should serialize an empty buffer", ({ expect }) => {
      const value = schema.serialize(new Uint8Array(0))
      expect(value).toEqual(serializedOk("00"))
    })

    test("should serialize a buffer with one byte", ({ expect }) => {
      const value = schema.serialize(hexToUint8Array("12"))
      expect(value).toEqual(serializedOk("01 12"))
    })

    test("should serialize a buffer with 128 bytes", ({ expect }) => {
      const value = schema.serialize(sampleBuffer.slice(0, 128))
      expect(value).toMatchSnapshot()
    })

    test("should reject a non-canonical length prefix which could fit one byte when allowNoncanonical is false", ({
      expect,
    }) => {
      const value = schema.parse(hexToUint8Array("81 01 12"))
      expect(value).toMatchSnapshot("error")
    })

    test("should accept a non-canonical length prefix which could fit one byte when allowNoncanonical is true", ({
      expect,
    }) => {
      const value = schema.parse(hexToUint8Array("81 01 12"), 0, {
        allowNoncanonical: true,
      })
      expect(value).toEqual(parsedOk(3, hexToUint8Array("12")))
    })

    test("should reject a non-canonical length prefix which could fit two bytes when allowNoncanonical is false", ({
      expect,
    }) => {
      const testVector = sampleBuffer.slice(0, 131)
      testVector.set(hexToUint8Array("82 00 80"), 0)
      const value = schema.parse(testVector)
      expect(value).toMatchSnapshot("error")
    })

    test("should reject a non-canonical length prefix which could fit two bytes when allowNoncanonical is true", ({
      expect,
    }) => {
      const testVector = sampleBuffer.slice(0, 131)
      testVector.set(hexToUint8Array("82 00 80"), 0)
      const value = schema.parse(testVector, 0, { allowNoncanonical: true })
      expect(value).toMatchSnapshot()
    })
  })

  describe("with variable length containing a sequence of uint8", () => {
    const schema = octetString().containing(sequenceOf(uint8Number()))

    test("should serialize an array of five numbers", ({ expect }) => {
      const value = schema.serialize([1, 2, 3, 4, 5])
      expect(value).toEqual(serializedOk(hexToUint8Array("0701050102030405")))
    })

    test("should parse an array of five numbers", ({ expect }) => {
      const value = schema.parse(hexToUint8Array("0701050102030405"))
      expect(value).toEqual(parsedOk(8, [1, 2, 3, 4, 5]))
    })
  })

  describe("with fixed length containing a uint32", () => {
    const schema = octetString(4).containing(uint32Number())

    test("should serialize 123456", ({ expect }) => {
      const value = schema.serialize(123_456)
      expect(value).toEqual(serializedOk("0001e240"))
    })

    test("should parse 123456", ({ expect }) => {
      const value = schema.parse(hexToUint8Array("0001e240"))
      expect(value).toEqual(parsedOk(4, 123_456))
    })
  })

  describe("with constrained variable length", () => {
    const schema = octetString([5, 8])

    test("should serialize a buffer with five bytes", ({ expect }) => {
      const value = schema.serialize(sampleBuffer.slice(0, 5))
      expect(value).toEqual(
        serializedOk(addLengthPrefix(sampleBuffer.slice(0, 5)))
      )
    })

    test("should parse a buffer with five bytes", ({ expect }) => {
      const value = schema.parse(addLengthPrefix(sampleBuffer.slice(0, 5)))
      expect(value).toEqual(parsedOk(6, sampleBuffer.slice(0, 5)))
    })

    test("should serialize a buffer with eight bytes", ({ expect }) => {
      const value = schema.serialize(sampleBuffer.slice(0, 8))
      expect(value).toEqual(
        serializedOk(addLengthPrefix(sampleBuffer.slice(0, 8)))
      )
    })

    test("should parse a buffer with eight bytes", ({ expect }) => {
      const value = schema.parse(addLengthPrefix(sampleBuffer.slice(0, 8)))
      expect(value).toEqual(parsedOk(9, sampleBuffer.slice(0, 8)))
    })

    test("should refuse to serialize a buffer with nine bytes", ({
      expect,
    }) => {
      const value = schema.serialize(sampleBuffer.slice(0, 9))
      expect(value).toMatchSnapshot()
    })

    test("should refuse to parse a buffer with nine bytes", ({ expect }) => {
      const value = schema.parse(addLengthPrefix(sampleBuffer.slice(0, 9)))
      expect(value).toMatchSnapshot()
    })

    test("should refuse to serialize a buffer with four bytes", ({
      expect,
    }) => {
      const value = schema.serialize(sampleBuffer.slice(0, 4))
      expect(value).toMatchSnapshot()
    })

    test("should refuse to parse a buffer with four bytes", ({ expect }) => {
      const value = schema.parse(addLengthPrefix(sampleBuffer.slice(0, 4)))
      expect(value).toMatchSnapshot()
    })
  })
})
